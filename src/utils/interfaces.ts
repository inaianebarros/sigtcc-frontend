export interface Course {
    name: string;
}

export type ExpertiseAreas = {
    name: string;
    uuid: string;
}

export type Institute = {
    name: string;
    uuid: string;
};

export interface Professor {
    biography: string;
    institute: Institute;
    expertise_areas: ExpertiseAreas[];
    user: User;
    uuid: string;
    lattes_url: string;
}

export interface ProfessorUUID {
    params: Promise<{ uuid: string }>
}

export interface User {
    email: string;
    first_name: string;
    uuid: string;
}

export interface UserLogin {
    access: string;
    refresh: string;
    username: string;
    role: string;
}

export interface Student {
    course: Course;
    user: User;
    enrollment: string;
    uuid: string;
}
