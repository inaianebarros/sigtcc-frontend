export type ExpertiseAreas = {
    name: string;
    uuid: string;
}

export type Institute = {
    name: string;
    uuid: string;
};

export interface Professor {
    institute: Institute;
    expertise_areas: ExpertiseAreas[];
    user: {
        email: string;
        first_name: string;
        uuid: string;
    };
    uuid: string;
}

export interface ProfessorUUID {
    params: Promise<{ uuid: string }>
}