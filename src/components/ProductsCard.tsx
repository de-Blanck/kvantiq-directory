interface Product {
  name: string;
  description: string;
  url?: string;
}

export default function ProductsCard({ products }: { products: Product[] }) {
  return (
    <div className="flex flex-col gap-3">
      {products.map((p, i) => (
        <div key={i}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] text-text-primary">{p.name}</span>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-info text-[12px] hover:underline">↗</a>
            )}
          </div>
          <p className="text-[13px] text-text-secondary mt-0.5 leading-relaxed">{p.description}</p>
        </div>
      ))}
    </div>
  );
}
