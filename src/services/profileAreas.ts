export interface ApiProfileArea {
  id: number;
  name: string;
  is_common: boolean;
}

export interface ProfileAreaView {
  id: number;
  name: string;
  isCommon: boolean;
}

/** As áreas de um perfil, com a marca de quais são em comum com quem está vendo (RN23). */
export function toProfileAreas(areas: ApiProfileArea[]): ProfileAreaView[] {
  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    isCommon: area.is_common,
  }));
}
