import { LIMITS, utf8ByteLength } from "@shared/index";

export interface JSONFileOptions<T> {
  validate?: (data: T) => boolean;
  maxBytes?: number;
}

export function getLocalJSONFile<T = unknown>(
  filePath: string,
  options?: JSONFileOptions<T>,
): Promise<T> {
  const maxBytes = options?.maxBytes ?? LIMITS.MAX_PAYLOAD_BYTES * 4;
  return new Promise<T>((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: "utf8",
      success: (res: any) => {
        try {
          if (res.errMsg !== "readFile:ok") {
            reject(new Error("readFile failed"));
            return;
          }
          const text = res.data as string;
          if (utf8ByteLength(text) > maxBytes) {
            reject(new Error("json file too large"));
            return;
          }
          const json = JSON.parse(text) as T;
          if (options?.validate && !options.validate(json)) {
            reject(new Error("json validation failed"));
            return;
          }
          resolve(json);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("json parse failed"));
        }
      },
      fail: (err: any) => reject(err),
    });
  });
}
