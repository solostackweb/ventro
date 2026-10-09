import { NextRequest, NextResponse } from 'next/server';
import { getPresignedDownloadUrl } from '@/lib/r2/client';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: report, error } = await supabase.from('personalized_reports').select('r2_key,status').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (error || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  if (report.status !== 'ready' || !report.r2_key) return NextResponse.json({ error: 'Report is not ready for download' }, { status: 409 });
  const signed = await getPresignedDownloadUrl(report.r2_key, 300);
  if (!signed.success || !signed.url) return NextResponse.json({ error: 'Unable to prepare download' }, { status: 500 });
  return NextResponse.redirect(signed.url);
}
