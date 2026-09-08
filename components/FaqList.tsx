export interface FaqItem {
  q: string;
  a: string;
}

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div>
      {items.map((item, i) => (
        <details key={i} className="faq-item">
          <summary className="faq-q">
            <span>{item.q}</span>
            <span className="chev">＋</span>
          </summary>
          <div className="faq-a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
