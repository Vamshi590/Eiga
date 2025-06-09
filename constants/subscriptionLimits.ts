// Subscription plan limits for EIGA app
export type PlanType = 'free' | 'pro' | 'cinephile';

export const PLAN_LIMITS: Record<PlanType, {
  rooms: number | null; // null = unlimited
  members: number | null;
  movies: number | null;
}> = {
  free:      { rooms: 2,   members: 5,   movies: 10 },
  pro:       { rooms: 7,  members: 20,  movies: 50 }, // Changed from 10 to 5
  cinephile: { rooms: null, members: 100, movies: null },
};

export function getPlanLimit(plan: PlanType, key: keyof typeof PLAN_LIMITS['free']) {
  return PLAN_LIMITS[plan][key];
}

export function isOverLimit(plan: PlanType, key: keyof typeof PLAN_LIMITS['free'], value: number) {
  const limit = getPlanLimit(plan, key);
  if (limit === null) return false;
  return value >= limit;
}
