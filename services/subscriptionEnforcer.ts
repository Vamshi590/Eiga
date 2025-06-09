import { PLAN_LIMITS, PlanType } from '../constants/subscriptionLimits';
import { supabase } from '../services/supabase';

/**
 * Fetches the user's plan from the profiles table.
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  if (error || !data) return 'free';
  return (data.plan as PlanType) || 'free';
}

/**
 * Throws an error if the user is over their allowed room count.
 */
export async function enforceRoomLimit(userId: string) {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].rooms;
  if (limit === null) return; // Unlimited
  const { data: userRooms, error } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);
  if (error) throw new Error('Could not check room limit');
  if (userRooms && userRooms.length >= limit) {
    const err: any = new Error('Room limit reached for your plan. Upgrade to create more rooms.');
    err.code = 403;
    err.reason = 'room_limit';
    throw err;
  }
}

/**
 * Throws an error if the room is at its member limit.
 */
export async function enforceRoomMemberLimit(roomId: string, plan: PlanType) {
  const limit = PLAN_LIMITS[plan].members;
  if (limit === null) return; // Unlimited
  const { data: members, error } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', roomId);
  if (error) throw new Error('Could not check member limit');
  if (members && members.length >= limit) {
    const err: any = new Error('Member limit reached for your plan. Upgrade to add more members.');
    err.code = 403;
    err.reason = 'member_limit';
    throw err;
  }
}

/**
 * Throws an error if the room is at its movie suggestion limit.
 */
export async function enforceRoomMovieLimit(roomId: string, plan: PlanType) {
  const limit = PLAN_LIMITS[plan].movies;
  if (limit === null) return; // Unlimited
  const { data: movies, error } = await supabase
    .from('movie_suggestions')
    .select('id')
    .eq('room_id', roomId);
  if (error) throw new Error('Could not check movie limit');
  if (movies && movies.length >= limit) {
    const err: any = new Error('Movie limit reached for your plan. Upgrade to add more movies.');
    err.code = 403;
    err.reason = 'movie_limit';
    throw err;
  }
}
