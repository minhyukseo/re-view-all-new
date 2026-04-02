/**
 * HTML 엔티티를 디코딩합니다. (예: &nbsp; -> " ")
 * 중복 인코딩을 방지하기 위해 텍스트가 정적 상태에 도달할 때까지 반복적으로 디코딩합니다.
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

  let prev = "";
  let curr = text;
  
  // 최대 5번까지 시도하여 무한 루프 방지 및 중복 인코딩(예: &amp;nbsp;) 해결
  for (let i = 0; i < 5; i++) {
    prev = curr;
    curr = curr.replace(/&[#\w\d]+;/g, (match) => {
      // 미리 정의된 엔티티 처리
      if (entities[match]) return entities[match];
      
      // 숫자 엔티티 처리 (예: &#43; -> +)
      if (match.startsWith("&#")) {
        try {
          const code = match.includes("x") 
            ? parseInt(match.slice(3, -1), 16) 
            : parseInt(match.slice(2, -1), 10);
          return String.fromCharCode(code);
        } catch {
          return match;
        }
      }
      return match;
    });
    
    if (prev === curr) break;
  }
  
  return curr;
}
