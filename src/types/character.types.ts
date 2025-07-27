export type Gender = 'male' | 'female';

export type CharacterAppearanceParts = {
  skinTone: string;
  hair: string;
  hairColor: string;
  eyes: string;
  mouth: string;
  beard?: string | null;
  markings?: string | null;
};

export type CharacterDraft = {
  gender: Gender;
} & CharacterAppearanceParts;