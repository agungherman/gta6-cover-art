// photos.js — the photo store of Neon Coast Cover Studio.
//
// A photo is { id, name, image, width, height } where image is an
// HTMLImageElement (uploads) or an ImageBitmap (samples). The store keeps
// the loaded photos in insertion order; the first two entries are the
// bundled samples so the app opens on a finished-looking cover. Photos are
// read on the person's own machine and never uploaded anywhere.

let counter = 0;

function nextId() {
  counter += 1;
  return `photo-${Date.now().toString(36)}-${counter}`;
}

export class PhotoStore {
  constructor() {
    this.photos = [];
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.photos);
  }

  get(id) {
    return this.photos.find((p) => p.id === id);
  }

  first() {
    return this.photos[0] || null;
  }

  add(image, name) {
    const photo = {
      id: nextId(),
      name: name || `Photo ${this.photos.length + 1}`,
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    this.photos.push(photo);
    this.emit();
    return photo;
  }

  remove(id) {
    const before = this.photos.length;
    this.photos = this.photos.filter((p) => p.id !== id);
    if (this.photos.length !== before) this.emit();
  }

  // Load one of the bundled sample photos (same-origin <img>, offline OK).
  // An <img> load is a tracked subresource, so a headless screenshot waits
  // for it the way it waits for fonts and stylesheets.
  async loadSample(path, name) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`sample not found: ${path}`));
      img.src = path;
    });
    return this.add(image, name);
  }

  // Load the two bundled samples in order; failures are reported, not hidden.
  async loadSamples() {
    const jobs = [
      this.loadSample('samples/boulevard.jpg', 'Boulevard sample'),
      this.loadSample('samples/pier.jpg', 'Pier sample'),
    ];
    const settled = await Promise.allSettled(jobs);
    const failed = settled.filter((r) => r.status === 'rejected');
    if (failed.length) {
      throw new Error(`could not load ${failed.length} sample photo(s)`);
    }
    return settled.map((r) => r.value);
  }

  // Load user files from an <input> or a drag-and-drop.
  async loadFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const added = [];
    for (const file of files) {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`cannot read ${file.name}`));
        img.src = URL.createObjectURL(file);
      });
      added.push(this.add(image, file.name));
    }
    return added;
  }

  // Draw a small thumbnail of a photo into a canvas and return a data URL.
  thumbnail(photo, size = 120) {
    const canvas = document.createElement('canvas');
    const scale = size / Math.max(photo.width, photo.height);
    canvas.width = Math.max(1, Math.round(photo.width * scale));
    canvas.height = Math.max(1, Math.round(photo.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(photo.image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }
}
