/**
 * Perfil del usuario: base de cuerpo, medidas y preferencia de ajuste.
 * Vive en el dispositivo (ver storage.ts) y alimenta el maniquí.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { predictBody, type BodyModelData, type BodyPrediction, type Sex } from '../core/bodyModel';
import type { Preference } from '../core/ease';
import { BY_KEY, type Body } from '../core/measurements';
import { loadBodyModel } from './bodyAsset';
import { KEYS, load, save, wipeAll } from './storage';

export interface Profile {
  version: 1;
  sex: Sex;
  /** Solo las medidas que ha dado el usuario. */
  measurements: Body;
  preference: Preference;
  consentAt: string;
  updatedAt: string;
}

interface ProfileState {
  ready: boolean;
  profile: Profile | null;
  setProfile: (p: Profile) => Promise<void>;
  setPreference: (p: Preference) => Promise<void>;
  wipe: () => Promise<void>;
  model: BodyModelData | null;
  modelError: string | null;
  prediction: BodyPrediction | null;
  /** Medidas para el motor de tallas: las dadas + las estimadas. */
  body: Body | null;
  retryModel: () => void;
}

const Ctx = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [model, setModel] = useState<BodyModelData | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    load<Profile | null>(KEYS.profile, null).then((p) => {
      setProfileState(p && p.version === 1 ? p : null);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    loadBodyModel()
      .then((m) => alive && setModel(m))
      .catch((e: unknown) => alive && setModelError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const setProfile = useCallback(async (p: Profile) => {
    setProfileState(p);
    await save(KEYS.profile, p);
  }, []);

  const setPreference = useCallback(async (preference: Preference) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, preference, updatedAt: new Date().toISOString() };
      void save(KEYS.profile, next);
      return next;
    });
  }, []);

  const wipe = useCallback(async () => {
    await wipeAll();
    setProfileState(null);
  }, []);

  const prediction = useMemo(() => {
    if (!profile || !model) return null;
    const known = Object.fromEntries(Object.entries(profile.measurements).filter(([k]) => k in BY_KEY));
    try {
      return predictBody(model, profile.sex, known);
    } catch {
      return null;
    }
  }, [profile, model]);

  const body = useMemo(() => {
    if (!profile) return null;
    // Sin maniquí todavía, el motor de tallas funciona con lo que dio el usuario.
    return prediction ? prediction.measurements : { ...profile.measurements };
  }, [profile, prediction]);

  const value = useMemo<ProfileState>(() => ({
    ready, profile, setProfile, setPreference, wipe, model, modelError, prediction, body,
    retryModel: () => {
      setModelError(null);
      setAttempt((a) => a + 1);
    },
  }), [ready, profile, setProfile, setPreference, wipe, model, modelError, prediction, body]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProfile fuera de ProfileProvider');
  return v;
}
