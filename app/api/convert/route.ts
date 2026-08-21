import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const fromFormat = formData.get('fromFormat');
    const toFormat = formData.get('toFormat');
    const file = formData.get('File');

    if (!file || !fromFormat || !toFormat) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const secret = process.env.CONVERT_API_SECRET; // Diambil dari environment variable Vercel
    const convertApiFormData = new FormData();
    convertApiFormData.append('File', file);

    const response = await fetch(`https://v2.convertapi.com/convert/${fromFormat}/to/${toFormat}?Secret=${secret}`, {
      method: 'POST',
      body: convertApiFormData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.Message || 'Kesalahan API eksternal.');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}