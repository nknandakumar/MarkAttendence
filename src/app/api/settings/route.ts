import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { appSettings, classes } from '@/db/schema';
import { getMentorSession } from '@/lib/auth/session';
import { isClassroomNetwork } from '@/lib/network/is-classroom-network';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const allSettings = await db.select().from(appSettings);
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value || '';
    }

    const { isAllowed, clientIp, allowedIps } = isClassroomNetwork(req);

    // Get current class details
    let currentClass = null;
    if (settingsMap.current_class_id) {
      const classId = parseInt(settingsMap.current_class_id, 10);
      if (!isNaN(classId)) {
        const found = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
        if (found.length > 0) {
          currentClass = found[0];
        }
      }
    }

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      currentClass,
      network: {
        isConfigured: allowedIps.length > 0,
        isCurrentIpAllowed: isAllowed,
        clientIp,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMentorSession();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, message: 'Key and value are required.' },
        { status: 400 }
      );
    }

    // Do NOT allow setting allowed IPs via API
    if (key === 'CLASSROOM_ALLOWED_IPS') {
      return NextResponse.json(
        { success: false, message: 'Classroom public IP must be set via server environment variable CLASSROOM_ALLOWED_IPS.' },
        { status: 403 }
      );
    }

    const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);

    if (existing.length > 0) {
      await db
        .update(appSettings)
        .set({
          value: String(value),
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({
        key,
        value: String(value),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Setting updated successfully.',
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update setting' },
      { status: 500 }
    );
  }
}
