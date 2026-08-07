import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/**
 * Thin wrapper around @aws-sdk/client-s3, pointed at MinIO today. Swapping
 * to a real S3/R2 provider later is a config-only change (endpoint +
 * credentials) — no code here is MinIO-specific except forcePathStyle,
 * which real S3 also accepts.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    const storage = configService.get('storage', { infer: true });
    this.bucket = storage.bucket;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  async uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }

    // Card images are not sensitive (ESCOPO.md §11) — public read, backend-only write.
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }),
      }),
    );
  }
}
