import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const dynamic = 'force-dynamic';

function cleanBase64(dataUri: string): { data: string; mimeType: string } {
  const match = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUri };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fotoCapturada, colaboradores } = body;

    if (!colaboradores || !Array.isArray(colaboradores) || colaboradores.length === 0) {
      return NextResponse.json({
        matched: false,
        message: 'Colaborador não encontrado. Nenhum colaborador cadastrado nesta empresa.',
      });
    }

    if (!fotoCapturada) {
      return NextResponse.json({
        matched: false,
        message: 'Nenhuma foto capturada pela câmera.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        matched: false,
        message: 'Chave de IA não configurada no servidor.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const parsedCaptured = cleanBase64(fotoCapturada);

    // Montar partes para o modelo
    const partesConteudo: any[] = [];

    partesConteudo.push({
      text: 'Você é um motor biométrico de reconhecimento facial de alta precisão para controle de ponto eletrônico corporativo.\n' +
            'A imagem a seguir é a FOTO CAPTURADA AO VIVO da câmera do totem:',
    });

    // Foto ao vivo da câmera
    partesConteudo.push({
      inlineData: {
        mimeType: parsedCaptured.mimeType,
        data: parsedCaptured.data,
      },
    });

    let totalFotosCadastradas = 0;

    colaboradores.forEach((c: any, index: number) => {
      const fotos = Array.isArray(c.fotosFaciais) && c.fotosFaciais.length > 0
        ? c.fotosFaciais
        : (c.avatar ? [c.avatar] : []);

      const validFotos = fotos
        .filter((f: any) => typeof f === 'string' && f.startsWith('data:image'))
        .slice(0, 2);

      if (validFotos.length > 0) {
        partesConteudo.push({
          text: `\n[COLABORADOR CANDIDATO ${index + 1}]: ID="${c.id}", NOME="${c.nome}", CARGO="${c.cargo || 'Funcionário'}". Foto(s) de referência:`,
        });
        validFotos.forEach((f: string) => {
          const parsed = cleanBase64(f);
          partesConteudo.push({
            inlineData: {
              mimeType: parsed.mimeType,
              data: parsed.data,
            },
          });
        });
        totalFotosCadastradas++;
      }
    });

    if (totalFotosCadastradas === 0) {
      return NextResponse.json({
        matched: false,
        message: 'Colaborador não encontrado. Nenhum colaborador possui fotos cadastradas.',
      });
    }

    partesConteudo.push({
      text: `INSTRUÇÕES OBRIGATÓRIAS:\n` +
            `1. Compare o rosto humano na PRIMEIRA imagem (câmera ao vivo) com as fotos de referência dos colaboradores listados acima.\n` +
            `2. Se o rosto na câmera corresponder com certeza ou forte semelhança a um dos colaboradores (mesma pessoa, mesmo com variação leve de ângulo ou iluminação), retorne matched=true, colaboradorId="<ID exato>", colaboradorNome="<NOME>", confianca=85.\n` +
            `3. Se for uma pessoa desconhecida, não cadastrada, ou não for a mesma pessoa, retorne matched=false, colaboradorId=null, message="Colaborador não encontrado".\n` +
            `4. Responda estritamente em JSON com o formato solicitado.`,
    });

    // Lista de modelos ordenada por velocidade e disponibilidade
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
    let lastError = null;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: partesConteudo,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                matched: { type: Type.BOOLEAN },
                colaboradorId: { type: Type.STRING },
                colaboradorNome: { type: Type.STRING },
                confianca: { type: Type.NUMBER },
                message: { type: Type.STRING },
              },
              required: ['matched'],
            },
          },
        });

        const resultadoTexto = response.text?.trim() || '{}';
        let parsedResultado: any = {};
        try {
          parsedResultado = JSON.parse(resultadoTexto);
        } catch {
          parsedResultado = { matched: false };
        }

        if (!parsedResultado.matched) {
          parsedResultado.message = 'Colaborador não encontrado';
          parsedResultado.colaboradorId = null;
        }

        return NextResponse.json(parsedResultado);
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Tentativa com modelo ${model} falhou:`, modelErr?.message || modelErr);
        // Tentar o próximo modelo
      }
    }

    console.error('Todos os modelos de IA falharam:', lastError);
    return NextResponse.json({
      matched: false,
      message: 'Colaborador não encontrado',
      detalhes: lastError?.message || 'Erro na análise facial',
    });
  } catch (err: any) {
    console.error('Erro no reconhecimento facial:', err);
    return NextResponse.json({
      matched: false,
      message: 'Colaborador não encontrado',
      detalhes: err?.message,
    });
  }
}
