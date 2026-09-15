import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnerSession } from '@/lib/auth'
import { deleteKtpFileByUrl } from '@/lib/ktp'

/**
 * PATCH /api/admin/marketings/[id]
 * Edit data rekanan / sakelar cepat aktif-nonaktif — KHUSUS OWNER.
 * Body (semua opsional): fullName, phoneNumber, addressCity, notes, ktpPhotoUrl ("" utk hapus KTP), isActive
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.marketing.findUnique({
      where: { id },
      include: { showroom: { select: { slug: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Rekanan tidak ditemukan.' }, { status: 404 })
    }
    const session = requireOwnerSession(req, existing.showroom.slug)
    if (!session) {
      return NextResponse.json(
        { error: 'Hanya owner yang boleh mengelola rekanan marketing.' },
        { status: 403 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const data: {
      fullName?: string
      phoneNumber?: string
      addressCity?: string
      notes?: string | null
      ktpPhotoUrl?: string | null
      isActive?: boolean
    } = {}

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim().slice(0, 60)
      if (fullName.length < 2) {
        return NextResponse.json({ error: 'Nama lengkap wajib diisi (min. 2 karakter).' }, { status: 400 })
      }
      data.fullName = fullName
    }

    if (body.phoneNumber !== undefined) {
      const rawPhone = String(body.phoneNumber).replace(/\D/g, '')
      const phone = rawPhone.startsWith('62')
        ? rawPhone
        : rawPhone.startsWith('0')
          ? `62${rawPhone.slice(1)}`
          : rawPhone
      const localDigits = phone.startsWith('62') ? `0${phone.slice(2)}` : phone
      if (!localDigits.startsWith('08') || localDigits.length < 10 || localDigits.length > 14) {
        return NextResponse.json(
          { error: 'Nomor WhatsApp wajib format Indonesia 08xxx (10-14 digit).' },
          { status: 400 },
        )
      }
      const dup = await db.marketing.findFirst({
        where: { showroomId: existing.showroomId, phoneNumber: phone, id: { not: id } },
      })
      if (dup) {
        return NextResponse.json(
          { error: `Nomor ${localDigits} sudah terdaftar atas nama "${dup.fullName}".` },
          { status: 409 },
        )
      }
      data.phoneNumber = phone
    }

    if (body.addressCity !== undefined) {
      const addressCity = String(body.addressCity).trim().slice(0, 60)
      if (addressCity.length < 2) {
        return NextResponse.json({ error: 'Domisili / kota asal wajib diisi.' }, { status: 400 })
      }
      data.addressCity = addressCity
    }

    if (body.notes !== undefined) {
      const notes = String(body.notes ?? '').trim().slice(0, 300)
      data.notes = notes || null
    }

    if (body.ktpPhotoUrl !== undefined) {
      const ktp = String(body.ktpPhotoUrl ?? '').trim().slice(0, 500)
      if (ktp && !ktp.startsWith('/api/admin/marketings/ktp/')) {
        return NextResponse.json(
          { error: 'URL foto KTP tidak valid. Upload dulu melalui tombol Upload KTP.' },
          { status: 400 },
        )
      }
      data.ktpPhotoUrl = ktp || null
    }

    if (body.isActive !== undefined) {
      data.isActive = !!body.isActive
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan.' }, { status: 400 })
    }

    // Kalau KTP diganti/dihapus, bersihkan file lama dari storage privat
    if (data.ktpPhotoUrl !== undefined && data.ktpPhotoUrl !== existing.ktpPhotoUrl) {
      await deleteKtpFileByUrl(existing.ktpPhotoUrl)
    }

    await db.marketing.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin patch marketing] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/marketings/[id]
 * Hapus rekanan — KHUSUS OWNER.
 * Riwayat booking tetap utuh (marketingName/phone denormalisasi, marketing_id jadi null).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.marketing.findUnique({
      where: { id },
      include: { showroom: { select: { slug: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Rekanan tidak ditemukan.' }, { status: 404 })
    }
    const session = requireOwnerSession(req, existing.showroom.slug)
    if (!session) {
      return NextResponse.json(
        { error: 'Hanya owner yang boleh mengelola rekanan marketing.' },
        { status: 403 },
      )
    }

    await db.marketing.delete({ where: { id } })
    // Foto KTP ikut dibersihkan dari storage privat
    await deleteKtpFileByUrl(existing.ktpPhotoUrl)
    return NextResponse.json({ ok: true, message: `Rekanan "${existing.fullName}" dihapus.` })
  } catch (e) {
    console.error('[admin delete marketing] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
