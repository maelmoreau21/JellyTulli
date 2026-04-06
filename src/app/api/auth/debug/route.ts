export async function GET() {
  try {
    const mod = await import('@/lib/authOptions');
    const found = !!(mod && (mod.authOptions || mod.default));
    return new Response(JSON.stringify({ ok: true, authOptionsFound: found }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
