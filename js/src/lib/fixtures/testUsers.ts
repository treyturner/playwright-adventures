export interface TestUser {
  email: string;
  password: string;
  displayName?: string;
}

export const demoUser: TestUser = {
  email: 'demo@example.com',
  password: 'P@ssword123',
  displayName: 'Demo User'
};
