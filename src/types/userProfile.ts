export type Contact = {
  name: string;
  relation?: string;
  phone?: string;
  email?: string;
};

export type ServiceUse = {
  kind: string;
  org?: string;
  since?: string;
  until?: string;
};

export type Medication = {
  name: string;
  dosage?: string;
  route?: string;
  freq?: string;
  note?: string;
};

export interface UserProfile {
  id: string;
  personalInfo: {
    name: string;
    kana?: string;
    birthDate?: string;
    gender?: 'male' | 'female' | 'other';
    address?: string;
    phone?: string;
    email?: string;
    photoUrl?: string;
  };
  administrativeInfo?: {
    disabilityBook?: {
      type?: string;
      grade?: string;
      number?: string;
    };
    supportLevel?: number;
    careManager?: Contact;
  };
  familyComposition?: Contact[];
  serviceHistory?: ServiceUse[];
  medicalHistory?: {
    diagnoses?: string[];
    allergies?: string[];
    medications?: Medication[];
    primaryDoctor?: Contact;
    hospitalNotes?: string;
  };
  lifeHistory?: {
    education?: string;
    work?: string;
    narrative?: string;
  };
  hopesAndGoals?: {
    person?: string;
    family?: string;
  };
  assessments?: {
    strengths?: string[];
    iceberg?: {
      kind: 'person' | 'environment';
      id: string;
      label: string;
    }[];
    lastUpdated?: string;
  };
  supportPlan?: {
    activeVersion?: string;
    shortGoals?: string[];
    longGoals?: string[];
  };
  legacyDocuments?: {
    id: string;
    title: string;
    date?: string;
    url: string;
    ocrText?: string;
  }[];
  updatedAt?: string;
  createdAt?: string;
}
