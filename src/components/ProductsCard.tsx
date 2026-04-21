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
            <span className="h-sm text-text-primary">{p.name}</span>
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-accent text-xs hover:underline">↗</a>
            )}
          </div>
          <p className="body-sm text-text-secondary mt-1">{p.description}</p>
        </div>
      ))}
    </div>
  );
}
