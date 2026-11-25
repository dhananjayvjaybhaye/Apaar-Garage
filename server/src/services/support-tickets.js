import { randomBytes } from 'node:crypto';
import { acknowledgementMs } from '../config/store-policy.js';
import { complaintDueAt } from '../utils/complaint-deadline.js';
import { SupportRequest } from '../models/support-request.js';
import { writeForAccount } from './account-write.js';
import { HttpError } from '../utils/http-error.js';
import { recordAudit } from './audit.js';
import { transaction } from './transaction.js';

function number() {
  return 'AGT-' + randomBytes(8).toString('hex').toUpperCase();
}

export function recordSupportRequest(input, account, at = new Date()) {
  return writeForAccount(account, async (session) => {
    const [ticket] = await SupportRequest.create(
      [
        {
          ...input,
          account,
          ticketNumber: number(),
          status: 'open',
          createdAt: at,
          acknowledgeBy: new Date(+at + acknowledgementMs),
          dueAt: complaintDueAt(at),
        },
      ],
      { session },
    );
    return ticket;
  });
}

export function publicTicket(ticket) {
  const {
    ticketNumber,
    category,
    status,
    createdAt,
    acknowledgeBy,
    acknowledgedAt,
    dueAt,
    resolvedAt,
    replies,
  } = ticket;
  return {
    ticketNumber,
    category,
    status,
    createdAt,
    acknowledgeBy,
    acknowledgedAt,
    dueAt,
    resolvedAt,
    replies,
  };
}

export async function findTicket(filter, session = null) {
  const ticket = await SupportRequest.findOne({
    ...filter,
    anonymizedAt: { $exists: false },
  }).session(session).lean();
  if (!ticket) throw new HttpError(404, 'Check your ticket number and email and try again.');
  return ticket;
}

const nextStatuses = {
  open: ['acknowledged'],
  acknowledged: ['resolved'],
  resolved: ['closed'],
  closed: [],
};

export function supportActions(ticket) {
  return { nextStatus: nextStatuses[ticket.status]?.[0], canReply: ticket.status !== 'closed' };
}

export function updateTicket(ticketNumber, input, audit) {
  return transaction((session) => updateTicketRecord(ticketNumber, input, audit, session));
}

async function updateTicketRecord(ticketNumber, input, audit, session) {
  const ticket = await findTicket({ ticketNumber }, session);
  const status = input.status ?? (ticket.status === 'open' ? 'acknowledged' : ticket.status);
  if (status !== ticket.status && !nextStatuses[ticket.status]?.includes(status))
    throw new HttpError(409, 'That ticket status change is not available.');
  if (ticket.status === 'closed' && input.reply) throw new HttpError(409, 'This ticket is closed.');
  const now = new Date();
  const result = await SupportRequest.findOneAndUpdate(
    {
      _id: ticket._id,
      status: ticket.status,
      anonymizedAt: { $exists: false },
    },
    {
      $set: {
        status,
        ...(!ticket.acknowledgedAt && status === 'acknowledged' && { acknowledgedAt: now }),
        ...(!ticket.resolvedAt && status === 'resolved' && { resolvedAt: now }),
      },
      ...(input.reply && {
        $push: { replies: { from: 'support', message: input.reply, at: now } },
      }),
    },
    { returnDocument: 'after', runValidators: true, session },
  ).lean();
  if (!result) throw new HttpError(409, 'The ticket changed. Please refresh and try again.');
  if (status !== ticket.status || input.reply)
    await recordAudit('support.ticket_updated', {
      ...audit, target: ticketNumber,
      before: { status: ticket.status },
      after: { status, replyAdded: Boolean(input.reply) },
    }, session);
  return result;
}

export async function replyToTicket(filter, message) {
  const ticket = await SupportRequest.findOneAndUpdate(
    {
      ...filter,
      status: { $in: ['open', 'acknowledged'] },
      anonymizedAt: { $exists: false },
    },
    { $push: { replies: { from: 'customer', message, at: new Date() } } },
    { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!ticket) throw new HttpError(404, 'This ticket could not accept a reply.');
  return ticket;
}
