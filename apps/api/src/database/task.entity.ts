import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  cronSchedule!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  timezone!: string | null;
}
