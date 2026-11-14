import { UrlSearchField } from '../components/UrlSearchField';

interface ActivitySearchFieldProps {
  /** A busca que está na URL. */
  value: string;
  onSearch: (search: string) => void;
}

/** O campo "Título da atividade" da lista de atividades. */
export function ActivitySearchField({
  value,
  onSearch,
}: ActivitySearchFieldProps) {
  return (
    <UrlSearchField
      label="Título da atividade"
      value={value}
      onSearch={onSearch}
    />
  );
}
