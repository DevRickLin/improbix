import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  cronSchedule!: string;

  @Column('text')
  prompt!: string;

  @Column({ default: true })
  isActive!: boolean;
}
