import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const prisma = new PrismaClient();

function getTodayStr() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

function getCurrentTimeStr() {
  const date = new Date();
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const today = getTodayStr();
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: user.id, date: today },
    orderBy: { id: 'desc' }
  });

  return NextResponse.json(entry || null);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.name) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { username: session.user.name } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { action, pauseHours, travelHours, location, startTime, endTime } = body;
  
  const today = getTodayStr();
  const now = getCurrentTimeStr();

  let entry;
  if (body.id) {
    entry = await prisma.timeEntry.findUnique({ where: { id: body.id } });
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
  } else {
    entry = await prisma.timeEntry.findFirst({
      where: { userId: user.id, date: today },
      orderBy: { id: 'desc' }
    });
  }

  if (action === 'start') {
    if (entry && entry.startTime && !entry.endTime) {
      return NextResponse.json({ error: "Already started" }, { status: 400 });
    }
    
    // Create new entry
    entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        date: today,
        startTime: now,
        pauseHours: 0.5,
        travelHours: 0,
        location
      }
    });
    
    return NextResponse.json(entry);
  }

  if (action === 'stop') {
    if (!entry || !entry.startTime) {
      return NextResponse.json({ error: "Not started" }, { status: 400 });
    }

    const startParts = entry.startTime.split(':');
    const stopParts = now.split(':');
    const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);
    
    let diffHours = (stopMins - startMins) / 60;
    const finalPause = parseFloat(pauseHours) || 0;
    const finalTravel = parseFloat(travelHours) || 0;

    const totalHours = diffHours - finalPause + finalTravel;

    entry = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        endTime: now,
        pauseHours: finalPause,
        travelHours: finalTravel,
        location: location,
        totalHours: parseFloat(totalHours.toFixed(2))
      }
    });
    return NextResponse.json(entry);
  }

  if (action === 'update') {
    if (!entry) {
      return NextResponse.json({ error: "No entry today" }, { status: 400 });
    }
    
    let totalHours = null;
    if (startTime && endTime) {
        const startParts = startTime.split(':');
        const stopParts = endTime.split(':');
        const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const stopMins = parseInt(stopParts[0]) * 60 + parseInt(stopParts[1]);
        
        let diffHours = (stopMins - startMins) / 60;
        const finalPause = parseFloat(pauseHours) || 0;
        const finalTravel = parseFloat(travelHours) || 0;
        totalHours = parseFloat((diffHours - finalPause + finalTravel).toFixed(2));
    }

    entry = await prisma.timeEntry.update({
      where: { id: entry.id },
      data: {
        startTime,
        endTime,
        pauseHours: parseFloat(pauseHours) || 0,
        travelHours: parseFloat(travelHours) || 0,
        location: location,
        ...(totalHours !== null && { totalHours })
      }
    });
    return NextResponse.json(entry);
  }

  if (action === 'delete') {
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    await prisma.timeEntry.delete({
      where: { id: entry.id }
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}


