import { chipColors } from "@/app/styles";

export function getColorForUuid(uuid: string): string {
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
        hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % chipColors.length;
    return chipColors[index];
}