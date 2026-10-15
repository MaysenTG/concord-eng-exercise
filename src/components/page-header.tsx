type PageHeaderProps = {
  title: string;
  subtitle: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="page-header">
      <p className="eyebrow">Visa cases</p>
      <h1>{title}</h1>
      <p className="subtitle">{subtitle}</p>
    </header>
  );
}
