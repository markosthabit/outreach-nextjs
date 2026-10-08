export interface Servantee {
_id: string;
name: string;
phone: string;
diocese?: string | null;
birthDate?: string | Date | null;
notes?: string[];
}
