import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormField, FieldControl } from '../../ui/form-field/form-field';
import { CarViewer } from '../../car-viewer/car-viewer';
import { AdminSessionStore } from '../admin-session-store';
import { imageMaxBytes, modelMaxBytes, modelWarningBytes } from './admin-products.config';
import { issueFor, productRequestMessage } from './admin-product-feedback';
import type { AdminImage, AdminProductIssue } from './admin-product-types';

@Component({
  selector: 'app-admin-product-media',
  imports: [CarViewer, FormField, FieldControl],
  templateUrl: './admin-product-media.html',
  styleUrl: './admin-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductMedia {
  readonly images = input.required<AdminImage[]>();
  readonly modelUrl = input('');
  readonly prefilled = input<ReadonlySet<string>>(new Set());
  readonly pendingImageUrl = input('');
  readonly blurred = output<string>();
  protected readonly issueAltGroup = ({ field }: AdminProductIssue) => field === 'imageAlts';
  protected readonly issueAlt = ({ field }: AdminProductIssue) => field !== 'imageAlts';
  readonly imageUrlChanged = output<string>();
  readonly issues = input<AdminProductIssue[]>([]);
  protected readonly issueFor = issueFor;
  readonly imagesChanged = output<AdminImage[]>();
  readonly modelChanged = output<string>();
  readonly uploadingChanged = output<boolean>();
  private readonly api = inject(AdminSessionStore);
  protected readonly preview = signal(false);
  protected readonly busy = signal(false);
  protected readonly largeModel = signal(false);
  protected readonly error = signal('');
  protected readonly dragOver = signal(false);

  protected drag(event: DragEvent, active: boolean) {
    event.preventDefault();
    this.dragOver.set(active);
  }

  protected drop(event: DragEvent) {
    this.drag(event, false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.uploadImages(files);
  }

  protected selectFiles(input: HTMLInputElement, model: boolean) {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (model && files[0]) void this.uploadModel(files[0]);
    else if (!model) void this.uploadImages(files);
  }

  private async uploadImages(files: File[]) {
    if (!files.length) return;
    await this.upload(async () => {
      for (const file of files) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > imageMaxBytes
        )
          throw new Error('Choose JPG, PNG or WebP images no larger than 5 MB.');
      }
      const images = [...this.images()];
      for (const file of files) {
        const response = await this.api.upload<{ url: string }>(
          '/api/admin/media/image',
          file,
          file.type,
        );
        images.push({ url: response.url, alt: '' });
        this.imagesChanged.emit([...images]);
      }
    });
  }

  private async uploadModel(file: File) {
    await this.upload(async () => {
      if (!/\.glb$/i.test(file.name) || file.size > modelMaxBytes)
        throw new Error('Choose a .glb file no larger than 10 MB.');
      const response = await this.api.upload<{ url: string; bytes: number }>(
        '/api/admin/media/model',
        file,
        'model/gltf-binary',
      );
      this.largeModel.set(response.bytes > modelWarningBytes);
      this.modelChanged.emit(response.url);
    });
  }

  private async upload(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.uploadingChanged.emit(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(
        productRequestMessage(
          error,
          error instanceof Error &&
            !(error instanceof HttpErrorResponse) &&
            error.message.startsWith('Choose ')
            ? error.message
            : 'Upload failed. Try again.',
        ),
      );
    } finally {
      this.busy.set(false);
      this.uploadingChanged.emit(false);
    }
  }

  protected append(url: HTMLInputElement) {
    const value = url.value.trim();
    if (!value) return;
    if (!/^(https?:\/\/|\/(?!\/))/i.test(value)) {
      this.error.set('Enter an HTTPS image URL or a path starting with /.');
      return;
    }
    this.error.set('');
    this.imagesChanged.emit([...this.images(), { url: value, alt: '' }]);
    this.imageUrlChanged.emit('');
  }

  protected changeAlt(index: number, alt: string) {
    this.imagesChanged.emit(
      this.images().map((image, position) => (position === index ? { ...image, alt } : image)),
    );
  }

  protected move(from: number, position: number) {
    const images = [...this.images()];
    const [image] = images.splice(from, 1);
    images.splice(position, 0, image);
    this.imagesChanged.emit(images);
  }

  protected remove(index: number) {
    this.imagesChanged.emit(this.images().filter((_, position) => position !== index));
  }

  protected setModel(value: string) {
    this.largeModel.set(false);
    this.preview.set(false);
    this.modelChanged.emit(value);
  }
}
