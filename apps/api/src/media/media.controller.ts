import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { AuthGuard } from '../auth/auth.guard';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOAD_ROOT = resolve(process.cwd(), 'uploads');
const IMAGE_DIR = join(UPLOAD_ROOT, 'images');
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

type UploadedImage = {
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
};

@Controller('uploads')
export class MediaController {
  @Post('images')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async uploadImage(
    @UploadedFile() file: UploadedImage | undefined,
    @Req() request: Request,
  ) {
    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Image file is required');
    }

    const extension = ALLOWED_IMAGE_TYPES.get(file.mimetype);

    if (!extension) {
      throw new BadRequestException('Image must be JPG, PNG, WEBP, or GIF');
    }

    if ((file.size ?? file.buffer.length) > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }

    await mkdir(IMAGE_DIR, { recursive: true });

    const fileName = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${extension}`;
    const filePath = join(IMAGE_DIR, fileName);

    await writeFile(filePath, file.buffer);

    const origin = `${request.protocol}://${request.get('host')}`;

    return {
      url: `${origin}/uploads/images/${fileName}`,
    };
  }

  @Get('images/:fileName')
  serveImage(@Param('fileName') fileName: string, @Res() response: Response) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/i.test(fileName)) {
      throw new BadRequestException('Invalid image file name');
    }

    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return response.sendFile(join(IMAGE_DIR, fileName));
  }
}
