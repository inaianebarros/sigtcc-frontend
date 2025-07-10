export type ExpertiseAreas = {
    name: string;
    uuid: string;
}

export type Institute = {
    name: string;
    uuid: string;
};

export interface Professor {
    biography: string,
    institute: Institute;
    expertise_areas: ExpertiseAreas[];
    user: {
        email: string;
        first_name: string;
        uuid: string;
    };
    uuid: string;
    lattes_url: string
}

export interface ProfessorUUID {
    params: Promise<{ uuid: string }>
}