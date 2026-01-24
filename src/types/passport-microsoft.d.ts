declare module 'passport-microsoft' {
  import { Strategy as PassportStrategy } from 'passport';

  export interface MicrosoftProfile {
    id: string;
    displayName: string;
    name: {
      familyName: string;
      givenName: string;
    };
    emails: Array<{ value: string; type?: string }>;
    photos?: Array<{ value: string }>;
    provider: string;
  }

  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        tenant?: string;
      },
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: MicrosoftProfile,
        done: (error: any, user?: any, info?: any) => void
      ) => void
    );
  }
}
