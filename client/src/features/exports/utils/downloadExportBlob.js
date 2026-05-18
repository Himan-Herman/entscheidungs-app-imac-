/**
 * @param {Response} res
 * @param {string} fallbackFilename
 */
export async function downloadExportBlob(res, fallbackFilename) {
  if (!res.ok) throw new Error("download_failed");
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match?.[1] || fallbackFilename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
