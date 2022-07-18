import { IAction, IActions, ILogger } from './types'

export class MockedLogger<T extends string = ''> implements ILogger<T> {
  child = jest.fn()
  setParser = jest.fn()
  addMeta = jest.fn()
  switchTransport = jest.fn()
  action = jest.fn().mockReturnValue({ success: jest.fn(), failure: jest.fn().mockImplementation((error) => error) })
  actions = jest.fn().mockReturnValue({ end: jest.fn() })
  info = jest.fn()
  warn = jest.fn()
  error = jest.fn()
}

export function mockAction<T extends string = ''>(logger: ILogger<T>): IAction {
  const action = {
    success: jest.fn(),
    failure: jest.fn().mockImplementation((error) => error),
  }
  logger.action = jest.fn().mockReturnValue(action)
  return action
}

export function mockActions<T extends string = ''>(logger: ILogger<T>): IActions {
  const actions = { end: jest.fn() }
  logger.actions = jest.fn().mockReturnValue(actions)
  return actions
}
