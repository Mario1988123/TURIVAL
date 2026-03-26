import { createClient } from './client'
import type { OCRDocumento, Pedido } from '../types/erp'

/**
 * Procesa OCR usando Tesseract.js (gratuito, local)
 * Alternativa: Google Cloud Vision o OpenAI Vision para mayor precisión
 */

// Instalación necesaria: npm install tesseract.js

import Tesseract from 'tesseract.js'

/**
 * Extraer texto de imagen usando Tesseract.js
 */
export async function extraerTextoOCR(imagenUrl: string): Promise<string> {
  try {
    const worker = await Tesseract.createWorker('spa') // español
    const result = await worker.recognize(imagenUrl)
    const texto = result.data.text
    await worker.terminate()

    return texto
  } catch (error) {
    console.error('[v0] Error en OCR:', error)
    throw error
  }
}

/**
 * Parsear datos de un presupuesto/pedido recurrente del texto OCR
 * Busca patrones comunes: referencias cliente, cantidades, dimensiones
 */
export interface DatosExtraidosOCR {
  referencias_cliente: string[]
  cantidades: number[]
  dimensiones: string[]
  colores: string[]
  observaciones: string
}

export function parsearDatosOCR(texto: string): DatosExtraidosOCR {
  // Buscar referencias de cliente (patrones como REF-001, A-001, etc)
  const referencias_cliente = (
    texto.match(/(?:ref(?:erencia)?|art(?:ículo)?)[:\s]*([A-Z0-9\-]+)/gi) || []
  ).map((m) => m.split(/[:\s]+/).pop()!)

  // Buscar números (cantidades, dimensiones)
  const numeros = texto.match(/\d+(?:[.,]\d+)?/g) || []

  // Buscar dimensiones (1000x500, 100mm, etc)
  const dimensiones = (
    texto.match(/\d+(?:[x×])\d+(?:\s*(?:mm|cm|m))?/gi) || []
  )

  // Buscar colores comunes (RAL, NCS, referencias)
  const colores = (
    texto.match(
      /(RAL\s*\d+|NCS\s*[A-Z]\s*\d+|blanco|negro|rojo|azul|verde|amarillo|gris|mate|brillo|satinado)/gi
    ) || []
  ).map((c) => c.trim())

  return {
    referencias_cliente: [...new Set(referencias_cliente)],
    cantidades: numeros.map((n) => parseFloat(n.replace(',', '.'))),
    dimensiones: [...new Set(dimensiones)],
    colores: [...new Set(colores)],
    observaciones: texto,
  }
}

/**
 * Matchear referencias OCR con referencias de cliente existentes
 */
export async function matchearReferenciaCliente(
  cliente_id: string,
  referencia_texto: string
): Promise<string | null> {
  const supabase = createClient()

  // Búsqueda por similitud
  const { data, error } = await supabase
    .from('referencias_cliente')
    .select('id, referencia_cliente')
    .eq('cliente_id', cliente_id)
    .ilike('referencia_cliente', `%${referencia_texto}%`)
    .limit(1)

  if (error || !data || data.length === 0) return null

  return data[0].id
}

/**
 * Crear documento OCR en la BD
 */
export async function crearDocumentoOCR(
  cliente_id: string,
  archivo_url: string,
  texto_extraido: string,
  datos_extraidos: DatosExtraidosOCR
): Promise<OCRDocumento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ocr_documentos')
    .insert({
      cliente_id,
      archivo_url,
      texto_extraido,
      estado: 'procesado',
      datos_extraidos: datos_extraidos as any,
    })
    .select()
    .single()

  if (error) throw error
  return data as OCRDocumento
}

/**
 * Procesar documento OCR completo:
 * 1. Extraer texto
 * 2. Parsear datos
 * 3. Guardar documento
 * 4. Retornar datos para validación humana
 */
export async function procesarDocumentoOCR(
  cliente_id: string,
  archivo_url: string
): Promise<OCRDocumento> {
  // Extraer texto
  const texto_extraido = await extraerTextoOCR(archivo_url)

  // Parsear datos
  const datos_extraidos = parsearDatosOCR(texto_extraido)

  // Guardar documento
  const documento = await crearDocumentoOCR(
    cliente_id,
    archivo_url,
    texto_extraido,
    datos_extraidos
  )

  return documento
}

/**
 * Validar y confirmar datos OCR
 * Crea un pedido desde los datos validados
 */
export async function validarYCrearPedidoDesdeOCR(
  ocr_id: string,
  cliente_id: string,
  lineas_pedido: any[] // Líneas confirmadas por usuario
): Promise<Pedido> {
  const supabase = createClient()

  // Actualizar documento como validado
  const { error: updateError } = await supabase
    .from('ocr_documentos')
    .update({
      estado: 'validado',
      referencia_pedido: 'EN_CREACION',
    })
    .eq('id', ocr_id)

  if (updateError) throw updateError

  // Crear pedido
  const numero_pedido = `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`

  const { data: pedido, error: pedError } = await supabase
    .from('pedidos')
    .insert({
      numero: numero_pedido,
      cliente_id,
      origen: 'ocr',
      estado: 'pendiente',
      fecha_entrada: new Date().toISOString().split('T')[0],
    })
    .select()
    .single()

  if (pedError) throw pedError

  // Actualizar documento con referencia al pedido
  await supabase
    .from('ocr_documentos')
    .update({ referencia_pedido: pedido.numero })
    .eq('id', ocr_id)

  return pedido as Pedido
}

/**
 * Obtener documentos OCR pendientes de validación
 */
export async function obtenerOCRPendientes(cliente_id?: string) {
  const supabase = createClient()

  let query = supabase
    .from('ocr_documentos')
    .select('*')
    .eq('estado', 'procesado')
    .order('created_at', { ascending: false })

  if (cliente_id) {
    query = query.eq('cliente_id', cliente_id)
  }

  const { data, error } = await query

  if (error) throw error
  return data as OCRDocumento[]
}

/**
 * Rechazar documento OCR
 */
export async function rechazarDocumentoOCR(
  ocr_id: string,
  observaciones: string
): Promise<OCRDocumento> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ocr_documentos')
    .update({
      estado: 'rechazado',
      observaciones,
    })
    .eq('id', ocr_id)
    .select()
    .single()

  if (error) throw error
  return data as OCRDocumento
}
