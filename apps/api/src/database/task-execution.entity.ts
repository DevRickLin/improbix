import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TaskExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer', nullable: true })
  taskId!: number | null;

  @Column({ type: 'varchar' })
  taskName!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'varchar', default: 'running' })
  status!: 'running' | 'success' | 'error';

  @Column({ type: 'datetime' })
  startedAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt!: Date | null;
}
