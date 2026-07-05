'use client';

import { useActionState } from 'react';
import { createUser, type CreateUserResult } from './actions';

const initialState: CreateUserResult = { success: false };

export function CreateUserForm() {
  const [state, formAction, isPending] = useActionState(createUser, initialState);

  return (
    <div className='space-y-4'>
      <form action={formAction} className='flex flex-wrap gap-3 items-start'>
        {state.error?.general && (
          <div className='w-full p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm'>
            {state.error.general}
          </div>
        )}

        <div>
          <label htmlFor='name' className='block text-sm font-medium mb-1'>
            Name
          </label>
          <input
            type='text'
            id='name'
            name='name'
            required
            className='px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {state.error?.name && <p className='mt-1 text-sm text-red-600'>{state.error.name[0]}</p>}
        </div>

        <div>
          <label htmlFor='email' className='block text-sm font-medium mb-1'>
            Email
          </label>
          <input
            type='email'
            id='email'
            name='email'
            required
            className='px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {state.error?.email && (
            <p className='mt-1 text-sm text-red-600'>{state.error.email[0]}</p>
          )}
        </div>

        <button
          type='submit'
          disabled={isPending}
          className='mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {isPending ? 'Creating...' : 'Create User'}
        </button>
      </form>

      {state.success && state.tempPassword && (
        <div className='p-3 bg-green-100 border border-green-300 text-green-900 rounded-lg text-sm'>
          User created. Temporary password (shown once — relay it to the new user):{' '}
          <code className='font-mono bg-white/60 px-1.5 py-0.5 rounded'>{state.tempPassword}</code>
        </div>
      )}
    </div>
  );
}
