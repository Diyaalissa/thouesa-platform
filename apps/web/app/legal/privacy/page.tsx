import fs from "fs";
import path from "path";
import { marked } from "marked";

export default function PrivacyPage() {
  const p = path.join(process.cwd(), "..", "..", "docs", "legal", "privacy.md");
  const md = fs.readFileSync(p, "utf8");
  const html = marked.parse(md);

  return (
    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html as any }} />
  );
}
