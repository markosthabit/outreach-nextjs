import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Servantee } from '@/models/servantee.model'
import { getAuthUser } from '@/lib/auth-helpers'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const authUser = await getAuthUser(req)
    
    // Check if the user is an admin or has permissions
    if (!authUser) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const servantees = body.servantees

    if (!Array.isArray(servantees)) {
      return NextResponse.json({ message: 'Invalid data format, expected array of servantees.' }, { status: 400 })
    }

    let importedCount = 0
    let failedCount = 0
    let errors = []

    for (let i = 0; i < servantees.length; i++) {
      const item = servantees[i]
      
      if (!item.name || !item.phone) {
        failedCount++
        errors.push(`الصف رقم ${i + 2}: الإسم والتليفون مطلوبان.`)
        continue
      }

      try {
        // Ensure phone is a string and remove non-numeric chars for consistency if needed, but we'll leave as is
        const phoneString = String(item.phone).trim()
        
        const existing = await Servantee.findOne({ phone: phoneString })
        if (existing) {
          failedCount++
          errors.push(`الصف رقم ${i + 2} (${item.name}): رقم التليفون ${phoneString} موجود مسبقاً.`)
          continue
        }

        await Servantee.create({
          ...item,
          phone: phoneString,
          createdBy: authUser.sub,
          updatedBy: authUser.sub,
        })
        
        importedCount++
      } catch (err: any) {
        failedCount++
        errors.push(`الصف رقم ${i + 2} (${item.name}): ${err.message}`)
      }
    }

    return NextResponse.json({ importedCount, failedCount, errors }, { status: 200 })
  } catch (error) {
    console.error('[POST /servantees/import]', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
