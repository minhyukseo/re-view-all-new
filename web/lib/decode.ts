/**
 * HTML 엔티티를 디코딩합니다. (예: &nbsp; -> " ")
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#13;": "\r",
    "&#10;": "\n",
  };

  return text.replace(/&[#\w\d]+;/g, (match) => {
    return entities[match] || match;
  });
}
