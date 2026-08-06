import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IngestionUploadInterceptor implements NestInterceptor {
  private readonly upload: any;

  constructor(private readonly configService: ConfigService) {
    const maxUploadBytes = this.configService.get<number>('INGESTION_MAX_UPLOAD_BYTES', 10 * 1024 * 1024);
    const memoryStorage = require('multer').memoryStorage;
    const multer = require('multer');
    this.upload = multer({ 
      storage: memoryStorage(),
      limits: { fileSize: maxUploadBytes } 
    }).single('file');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return new Observable((observer) => {
      this.upload(req, res, (error: any) => {
        if (error) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            observer.error(new BadRequestException('File exceeds maximum allowed size'));
          } else {
            observer.error(error);
          }
        } else {
          observer.next(req);
          observer.complete();
        }
      });
    }).pipe(
      switchMap(() => next.handle())
    );
  }
}
