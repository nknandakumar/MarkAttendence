import { NextRequest, NextResponse } from 'next/server';
import { isClassroomNetwork } from '@/lib/network/is-classroom-network';

export async function GET(req: NextRequest) {
  try {
    const { isAllowed, clientIp } = isClassroomNetwork(req);

    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          isAllowed: false,
          clientIp,
          code: 'CLASSROOM_NETWORK_REQUIRED',
          message: 'Connect to the classroom Wi-Fi to mark attendance.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      isAllowed: true,
      clientIp,
      message: 'Classroom network verified',
    });
  } catch (error) {
    console.error('Error checking network:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong while verifying network status.',
      },
      { status: 500 }
    );
  }
}
