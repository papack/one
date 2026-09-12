import { signal } from "../signal";

interface UseImageUploadOptions {
  maxWidth: number;
}
export function useImageUpload(o: UseImageUploadOptions) {
  // signals
  const [file, setFile] = signal<File | null>(null);
  const [previewUrl, setPreviewUrl] = signal<string>("");
  const [hasFile, setHasFile] = signal<boolean>(false);
  const [isRunning, setIsRunning] = signal(false);
  const [isDone, setisDone] = signal(true);
  const [error, setError] = signal<string | null>(null);

  //select::
  async function select() {
    setIsRunning(() => true);
    setisDone(() => false);
    setError(() => null);
    try {
      //select file
      const rawImageFile = await selectFile();
      if (!rawImageFile) return;

      //only images allowed
      if (!rawImageFile.type.startsWith("image/")) {
        throw new Error("INVALID_FILE_TYPE");
      }

      //resize
      const resizedImageFile = await resizeImage(rawImageFile, o.maxWidth);

      //set raw file
      setFile(() => resizedImageFile);
      setHasFile(() => true);

      //preview url
      const dataUrl = await fileToDataUrl(resizedImageFile);
      setPreviewUrl(() => dataUrl);
    } catch (reason) {
      setError(() =>
        reason instanceof Error ? reason.message : "IMAGE_UPLOAD_FAILED",
      );
    } finally {
      setIsRunning(() => false);
      setisDone(() => true);
    }
  }
  function clear() {
    setHasFile(() => false);
    setPreviewUrl(() => "");
    setFile(() => null);
    setError(() => null);
  }

  return {
    file,
    previewUrl,
    hasFile,
    isProcessing: isRunning,
    isProcessed: isDone,
    error,
    select,
    clear,
  };
}

function selectFile(): Promise<File | null> {
  return new Promise((res) => {
    const input = document.createElement("input");
    let settled = false;

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      res(file);
    };

    input.type = "file";
    input.accept = "image/*";

    input.onchange = () => {
      finish(input.files?.[0] ?? null);
    };

    input.addEventListener("cancel", () => finish(null), { once: true });

    input.click();
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader();

    reader.onload = () => {
      res(reader.result as string);
    };

    reader.onerror = rej;

    reader.readAsDataURL(file);
  });
}

async function resizeImage(
  file: File,
  maxWidth = 800,
  quality = 0.85,
): Promise<File> {
  const img = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / img.width);

    const canvas = document.createElement("canvas");
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No Context!");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image conversion failed"));
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        quality,
      );
    });

    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    img.close();
  }
}
