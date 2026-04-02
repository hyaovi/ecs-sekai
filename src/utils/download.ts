/**
 * Util function to download JSON files.
 * @param data JSON object or array
 * @param fileName name of the file (e.g., 'data.json')
 */
export function downloadJSON<T>(data: T, fileName: string): void {
   const name = fileName.endsWith(".json") ? fileName : `${fileName}.json`;

   const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
   });

   const url = URL.createObjectURL(blob);

   const link = document.createElement("a");
   link.href = url;
   link.download = name;
   link.style.display = "none";

   document.body.appendChild(link);
   link.click();

   document.body.removeChild(link);
   URL.revokeObjectURL(url);
}
