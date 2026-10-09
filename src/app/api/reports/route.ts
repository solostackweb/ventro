import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createReportDocx } from '@/lib/reports/docx';
import { reportRequestSchema } from '@/lib/reports/schema';
import { buildPersonalizedReport, getReportFacets } from '@/lib/reports/service';
import { uploadToR2 } from '@/lib/r2/client';
import { createServerClient, hasFullAccess } from '@/lib/supabase/server';
import { ingestionSupabase } from '@/lib/supabase/ingestion';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const [{ data: reports, error }, facets] = await Promise.all([
    supabase.from('personalized_reports').select('id,title,status,requested_pages,period_days,geographies,file_name,file_size_bytes,generation_provider,created_at,completed_at,error_message').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    getReportFacets(),
  ]);
  if (error) return NextResponse.json({ error: 'Unable to load reports' }, { status: 500 });
  return NextResponse.json({ reports: reports ?? [], facets });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!await hasFullAccess()) return NextResponse.json({ error: 'An active trial or subscription is required to generate reports' }, { status: 403 });

  let input;
  try {
    input = reportRequestSchema.parse(await request.json());
  } catch (error) {
    const details = error instanceof ZodError ? error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) : undefined;
    return NextResponse.json({ error: 'Invalid report configuration', details }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: activeCount }, { count: dailyCount }] = await Promise.all([
    supabase.from('personalized_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).in('status', ['queued', 'generating']),
    supabase.from('personalized_reports').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since),
  ]);
  if ((activeCount ?? 0) >= 2) return NextResponse.json({ error: 'Two reports are already being generated. Please wait for one to finish.' }, { status: 429 });
  if ((dailyCount ?? 0) >= 8) return NextResponse.json({ error: 'Daily report limit reached. Try again tomorrow.' }, { status: 429 });

  const { data: report, error: insertError } = await supabase.from('personalized_reports').insert({
    user_id: user.id,
    title: input.title,
    status: 'generating',
    requested_pages: input.requestedPages,
    period_days: input.periodDays,
    geographies: input.geographies,
    fund_ids: input.fundIds,
    yc_batch_ids: input.ycBatchIds,
    topics: input.topics,
    included_sections: input.includedSections,
    audience: input.audience || null,
    purpose: input.purpose || null,
    configuration: input,
    started_at: new Date().toISOString(),
  }).select('id').single();
  if (insertError || !report) return NextResponse.json({ error: 'Unable to start report generation' }, { status: 500 });

  try {
    const generated = await buildPersonalizedReport(input);
    const { buffer, fileName } = await createReportDocx(generated.content, input);
    const r2Key = `personalized-reports/${user.id}/${report.id}/${fileName}`;
    const upload = await uploadToR2(r2Key, buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
      report_id: report.id,
      prompt_version: 'personalized-report-v1',
    });
    if (!upload.success) throw new Error(`REPORT_UPLOAD_FAILED:${upload.error || 'unknown upload error'}`);

    const completedAt = new Date().toISOString();
    const { error: updateError } = await ingestionSupabase.from('personalized_reports').update({
      status: 'ready',
      report_content: generated.content,
      source_manifest: generated.content.sources,
      r2_key: r2Key,
      file_name: fileName,
      file_size_bytes: buffer.byteLength,
      generation_provider: generated.provider,
      generation_model: generated.model,
      completed_at: completedAt,
      error_code: null,
      error_message: null,
    }).eq('id', report.id).eq('user_id', user.id);
    if (updateError) throw new Error(`REPORT_RECORD_UPDATE_FAILED:${updateError.message}`);
    return NextResponse.json({ report: { id: report.id, title: input.title, status: 'ready', file_name: fileName, file_size_bytes: buffer.byteLength, completed_at: completedAt } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Report generation failed';
    console.error('[reports] generation failed', { reportId: report.id, error: message });
    await ingestionSupabase.from('personalized_reports').update({
      status: 'failed',
      error_code: message.split(':')[0].slice(0, 80),
      error_message: message.replace(/(sk-|Bearer\s+)[A-Za-z0-9._-]+/g, '[REDACTED]').slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq('id', report.id).eq('user_id', user.id);
    return NextResponse.json({ error: 'Report generation failed. Your configuration was saved; please retry.' }, { status: 500 });
  }
}
