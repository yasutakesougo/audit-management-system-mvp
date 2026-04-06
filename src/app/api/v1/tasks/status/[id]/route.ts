import { updateStatus } from '@/infra/task/taskRepository';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const id = parseInt(params.id);
    
    // Call repository which now handles both string/boolean
    const updatedTask = await updateStatus(id, body);
    
    return Response.json({
        status: 'success',
        task: updatedTask
    });
  } catch (error) {
    return Response.json(
      { status: 'error', message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
