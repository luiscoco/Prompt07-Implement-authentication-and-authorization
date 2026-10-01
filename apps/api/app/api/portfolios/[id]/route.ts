import { requirePortfolio, accessResponse } from '../../../../lib/authorization';
export const runtime = 'nodejs';
// Read-only ownership demonstration; CRUD and transaction services are milestone 08.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { portfolio } = await requirePortfolio(request, (await context.params).id);
    return Response.json({ portfolio }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return accessResponse(request, error); }
}
