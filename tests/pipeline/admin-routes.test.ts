import { createServerClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { User } from '@supabase/supabase-js';
import { GET, POST } from '@/app/api/admin/pipelines/route';

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@/lib/supabase/ingestion', () => ({
  ingestionSupabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

import { ingestionSupabase } from '@/lib/supabase/ingestion';

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;
const mockIngestionSupabase = ingestionSupabase as jest.Mocked<typeof ingestionSupabase>;

describe('Admin Pipelines API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockUser = (id: string | null): User | null => {
    if (!id) return null;
    return {
      id,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${id}@example.com`,
      email_confirmed_at: new Date().toISOString(),
      phone: '',
      confirmation_sent_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const createMockRequest = (url: string, method = 'GET', body?: unknown) => {
    return {
      method,
      nextUrl: new URL(`http://localhost${url}`),
      json: jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest;
  };

  const createMockSupabaseClient = (getUserImpl: () => Promise<{ data: { user: User | null }; error: any }>) => ({
    auth: {
      getUser: jest.fn().mockImplementation(getUserImpl),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    supabaseUrl: 'http://localhost',
    supabaseKey: 'test-key',
    realtime: {},
    storage: {},
    functions: {},
    channel: jest.fn(),
    removeAllChannels: jest.fn(),
    from: jest.fn(),
    rpc: jest.fn(),
  });

  const mockUnauthenticatedClient = createMockSupabaseClient(() =>
    Promise.resolve({ data: { user: null }, error: { code: 'UNAUTHORIZED', status: 401 } })
  ) as any;

  const mockUserClient = createMockSupabaseClient(() =>
    Promise.resolve({ data: { user: createMockUser('user-1')! }, error: null })
  ) as any;

  const mockAdminClient = createMockSupabaseClient(() =>
    Promise.resolve({ data: { user: createMockUser('admin-1')! }, error: null })
  ) as any;

  const mockAdminProfile = { user_id: 'admin-1' };

  describe('GET /api/admin/pipelines', () => {
    it('returns 401 when not authenticated', async () => {
      mockCreateServerClient.mockResolvedValue(mockUnauthenticatedClient);

      const request = createMockRequest('/api/admin/pipelines');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
      expect(mockIngestionSupabase.from).not.toHaveBeenCalled();
      expect(mockIngestionSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not admin', async () => {
      mockCreateServerClient.mockResolvedValue(mockUserClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines');
      const response = await GET(request);
      
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Admin access required');
    });

    it('returns 200 and pipeline runs for admin user', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });
      (mockIngestionSupabase.rpc as jest.Mock).mockResolvedValue({ data: [{ id: 'run-1', status: 'completed' }], error: null });

      const request = createMockRequest('/api/admin/pipelines?action=runs');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.runs).toEqual([{ id: 'run-1', status: 'completed' }]);
      expect(mockIngestionSupabase.rpc).toHaveBeenCalledWith('get_recent_pipeline_runs', {
        p_limit: 50,
        p_pipeline_type: undefined,
      });
    });

    it('returns 400 for invalid action', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines?action=invalid');
      const response = await GET(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid action');
    });
  });

  describe('POST /api/admin/pipelines', () => {
    it('returns 401 when not authenticated', async () => {
      mockCreateServerClient.mockResolvedValue(mockUnauthenticatedClient);

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter' });
      const response = await POST(request);
      
      expect(response.status).toBe(401);
      expect(mockIngestionSupabase.from).not.toHaveBeenCalled();
      expect(mockIngestionSupabase.rpc).not.toHaveBeenCalled();
    });

    it('returns 403 when user is not admin', async () => {
      mockCreateServerClient.mockResolvedValue(mockUserClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter' });
      const response = await POST(request);
      
      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid replay request (missing attempt_id)', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter', reason: 'test' });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('attempt_id and reason required');
    });

    it('returns 400 for invalid replay request (missing reason)', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter', attempt_id: 'attempt-1' });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('attempt_id and reason required');
    });

    it('returns 400 for invalid UUID format', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter', attempt_id: 'invalid', reason: 'test' });
      const response = await POST(request);
      
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Invalid UUID format');
    });

    it('calls replay_dead_letter RPC for valid request', async () => {
      mockCreateServerClient.mockResolvedValue(mockAdminClient);
      (mockIngestionSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
          }),
        }),
      });
      (mockIngestionSupabase.rpc as jest.Mock).mockResolvedValue({ data: [{ new_attempt_id: 'new-attempt', old_attempt_id: 'old-attempt' }], error: null });

      const request = createMockRequest('/api/admin/pipelines', 'POST', { action: 'replay-dead-letter', attempt_id: '123e4567-e89b-12d3-a456-426614174000', reason: 'test reason' });
      const response = await POST(request);
      
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.replayed).toBeDefined();
      expect(mockIngestionSupabase.rpc).toHaveBeenCalledWith('replay_dead_letter', {
        p_attempt_id: '123e4567-e89b-12d3-a456-426614174000',
        p_reason: 'test reason',
      });
    });
  });
});
