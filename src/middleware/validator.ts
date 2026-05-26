import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

/**
 * Validation target — which part of the request to validate.
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Factory function that creates validation middleware for a given Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate (default: 'body')
 * @returns Express middleware function
 *
 * @example
 * router.post('/payments', validate(createPaymentSchema), controller.create);
 * router.get('/payments', validate(listPaymentsQuerySchema, 'query'), controller.list);
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const data = req[target];

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            target,
            errors,
          },
        },
      });
      return;
    }

    // Replace request data with parsed/coerced values
    req[target] = result.data;
    next();
  };
}

/**
 * Format Zod errors into a user-friendly structure.
 */
function formatZodErrors(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
