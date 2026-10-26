import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL_KEY = 'allowUnverifiedEmail';

/**
 * Opts an authenticated route out of the mandatory email-verification gate
 * (ADR-P041 Decision 2). Reserved for what an unverified user needs to get
 * verified or leave: reading their own account, resending the link, and
 * deleting the account. Everything else fails closed.
 */
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL_KEY, true);
